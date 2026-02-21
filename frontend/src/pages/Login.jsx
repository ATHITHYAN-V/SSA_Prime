import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { useNavigate } from 'react-router-dom';
import Swal from 'sweetalert2';

const Login = () => {
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [portalId, setPortalId] = useState('');
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);

    const { login } = useAuth();
    const navigate = useNavigate();

    const handleSubmit = async (e) => {
        e.preventDefault();
        setError('');
        setLoading(true);

        const result = await login(email, password, portalId);

        if (result.success) {
            await Swal.fire({
                icon: 'success',
                title: `Welcome back, <span style="color: #3409f8ff; font-weight:700;">
              ${result.role}
            </span>`,
                html: `
      <span style="color: #06d306ff; font-size: 16px; font-weight: 600;">
        Great to see you again. Redirecting to your dashboard...
      </span>
    `,
                timer: 2000,
                showConfirmButton: false
            });
            navigate('/dashboard');
        } else {
            Swal.fire({
                icon: 'error',
                title: 'Login Failed',
                text: result.message,
                confirmButtonColor: '#003366'
            });
            setError(result.message);
        }
        setLoading(false);
    };

    return (
        <div style={{
            position: 'fixed', inset: 0,
            background: 'radial-gradient(circle at top right, #003366, #000b1a)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontFamily: "'Montserrat', sans-serif",
            overflow: 'hidden', padding: 0, margin: 0
        }}>
            {/* Decorative dots */}
            <div style={{
                position: 'absolute', top: '10%', left: '5%', width: 200, height: 200,
                borderRadius: '50%', background: 'rgba(0,170,255,0.05)', filter: 'blur(60px)'
            }}></div>
            <div style={{
                position: 'absolute', bottom: '10%', right: '10%', width: 300, height: 300,
                borderRadius: '50%', background: 'rgba(0,86,179,0.08)', filter: 'blur(80px)'
            }}></div>

            <div style={{
                maxWidth: 420, width: '100%', padding: 20,
                animation: 'slideUp 0.8s ease-out'
            }}>
                <div style={{
                    backgroundColor: 'white', borderRadius: 20,
                    overflow: 'hidden', boxShadow: '0 20px 60px rgba(0,0,0,0.3)'
                }}>
                    {/* Top accent bar */}
                    <div style={{
                        height: 5,
                        background: 'linear-gradient(to right, #0056b3, #00aaff)'
                    }}></div>

                    <div style={{ padding: '2.5rem 2rem' }}>
                        {/* Header */}
                        <div style={{ textAlign: 'center', marginBottom: '2rem' }}>
                            <div style={{
                                width: 70, height: 70, borderRadius: '50%',
                                background: 'linear-gradient(135deg, #003366, #0066cc)',
                                display: 'flex', alignItems: 'center', justifyContent: 'center',
                                margin: '0 auto 16px', boxShadow: '0 4px 15px rgba(0,51,102,0.3)'
                            }}>
                                <i className="bi bi-shield-lock-fill" style={{ color: 'white', fontSize: '1.8rem' }}></i>
                            </div>
                            <h2 style={{ color: '#003366', fontWeight: 700, marginBottom: 4, fontSize: '1.4rem' }}>
                                Login Portal
                            </h2>
                            <p style={{ color: '#6c757d', fontSize: '0.85rem', margin: 0 }}>
                                Enter your credentials to access the portal
                            </p>
                        </div>

                        {error && (
                            <div style={{
                                background: '#fff5f5', border: '1px solid #fed7d7',
                                borderRadius: 10, padding: '10px 14px', marginBottom: 16,
                                color: '#c53030', fontSize: '0.85rem', textAlign: 'center'
                            }}>
                                <i className="bi bi-exclamation-circle me-1"></i> {error}
                            </div>
                        )}

                        <form onSubmit={handleSubmit}>
                            <div style={{ marginBottom: '1.2rem' }}>
                                <label style={{
                                    display: 'block', marginBottom: 6, fontWeight: 600,
                                    fontSize: '0.85rem', color: '#495057'
                                }}>
                                    <i className="bi bi-envelope me-1"></i> Email Address
                                </label>
                                <input
                                    type="email" required value={email}
                                    onChange={(e) => setEmail(e.target.value)}
                                    placeholder="name@company.com"
                                    autoComplete="off"
                                    name="login_email_field_nocache"
                                    id="login_email_field_nocache"
                                    style={{
                                        width: '100%', padding: '12px 14px', borderRadius: 10,
                                        border: '1px solid #dee2e6', fontSize: '0.92rem',
                                        fontFamily: "'Montserrat', sans-serif",
                                        transition: 'border-color 0.2s, box-shadow 0.2s',
                                        boxSizing: 'border-box'
                                    }}
                                    onFocus={e => { e.target.style.borderColor = '#0066cc'; e.target.style.boxShadow = '0 0 0 3px rgba(0,102,204,0.1)'; }}
                                    onBlur={e => { e.target.style.borderColor = '#dee2e6'; e.target.style.boxShadow = 'none'; }}
                                />
                            </div>

                            <div style={{ marginBottom: '1.2rem' }}>
                                <label style={{
                                    display: 'block', marginBottom: 6, fontWeight: 600,
                                    fontSize: '0.85rem', color: '#495057'
                                }}>
                                    <i className="bi bi-lock me-1"></i> Password
                                </label>
                                <input
                                    type="password" required value={password}
                                    onChange={(e) => setPassword(e.target.value)}
                                    placeholder="Enter your password"
                                    autoComplete="new-password"
                                    name="login_password_field_nocache"
                                    id="login_password_field_nocache"
                                    style={{
                                        width: '100%', padding: '12px 14px', borderRadius: 10,
                                        border: '1px solid #dee2e6', fontSize: '0.92rem',
                                        fontFamily: "'Montserrat', sans-serif",
                                        transition: 'border-color 0.2s, box-shadow 0.2s',
                                        boxSizing: 'border-box'
                                    }}
                                    onFocus={e => { e.target.style.borderColor = '#0066cc'; e.target.style.boxShadow = '0 0 0 3px rgba(0,102,204,0.1)'; }}
                                    onBlur={e => { e.target.style.borderColor = '#dee2e6'; e.target.style.boxShadow = 'none'; }}
                                />
                            </div>

                            {email.trim().toLowerCase() !== 'csk@gmail.com' && (
                            <div style={{ marginBottom: '1.5rem' }}>
                                <label style={{
                                    display: 'block', marginBottom: 6, fontWeight: 600,
                                    fontSize: '0.85rem', color: '#495057'
                                }}>
                                    <i className="bi bi-key me-1"></i> Portal ID
                                    <span style={{ fontWeight: 400, color: '#adb5bd', marginLeft: 6 }}></span>
                                </label>
                                <input
                                    type="text" value={portalId}
                                    onChange={(e) => setPortalId(e.target.value)}
                                    placeholder="Enter portal ID"
                                    style={{
                                        width: '100%', padding: '12px 14px', borderRadius: 10,
                                        border: '1px solid #dee2e6', fontSize: '0.92rem',
                                        fontFamily: "'Montserrat', sans-serif",
                                        transition: 'border-color 0.2s, box-shadow 0.2s',
                                        boxSizing: 'border-box'
                                    }}
                                    onFocus={e => { e.target.style.borderColor = '#0066cc'; e.target.style.boxShadow = '0 0 0 3px rgba(0,102,204,0.1)'; }}
                                    onBlur={e => { e.target.style.borderColor = '#dee2e6'; e.target.style.boxShadow = 'none'; }}
                                />
                            </div>
                            )}

                            <button
                                type="submit" disabled={loading}
                                style={{
                                    width: '100%', padding: '13px', border: 'none', borderRadius: 10,
                                    fontWeight: 700, fontSize: '0.95rem', cursor: loading ? 'not-allowed' : 'pointer',
                                    background: loading ? '#3d6b9e' : 'linear-gradient(135deg, #003366, #0066cc)',
                                    color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
                                    transition: 'all 0.2s', fontFamily: "'Montserrat', sans-serif",
                                    boxShadow: '0 4px 15px rgba(0,51,102,0.3)'
                                }}
                            >
                                {loading ? (
                                    <>
                                        <span className="ssa-spinner"></span>
                                        Authenticating...
                                    </>
                                ) : (
                                    <>
                                        <i className="bi bi-box-arrow-in-right"></i>
                                        Login
                                    </>
                                )}
                            </button>
                        </form>
                    </div>
                </div>

                {/* Footer */}
                <p style={{
                    textAlign: 'center', color: 'rgba(255,255,255,0.4)',
                    fontSize: '0.75rem', marginTop: 20
                }}>
                    SSA Automation &copy; {new Date().getFullYear()}
                </p>
            </div>
        </div>
    );
};

export default Login;
